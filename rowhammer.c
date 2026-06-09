// rowhammer.c — a minimal, educational Rowhammer self-test.
//
// What it does
// ------------
// Rowhammer is a DRAM disturbance effect: repeatedly activating ("hammering")
// the same DRAM rows can flip bits in physically adjacent rows. This program
// demonstrates the effect on *your own* machine's memory so you can learn how
// it works and check whether your RAM is susceptible. It does not attack any
// remote target — it only reads/writes a buffer this process allocated itself.
//
// How it works
// ------------
//   1. Allocate a large buffer and fill it with a known pattern (all 1s).
//   2. Repeatedly read from two addresses that are likely to live in different
//      rows of the same DRAM bank. Each read is followed by clflush so the CPU
//      cache is bypassed and the access actually reaches DRAM, forcing row
//      activations.
//   3. After many millions of hammer iterations, scan the buffer for any bit
//      that is no longer 1. Any such bit is a Rowhammer-induced flip.
//
// This is a probabilistic test: vulnerable hardware may need many runs and
// different address pairs before a flip appears; robust hardware (e.g. with
// ECC or target-row-refresh mitigations) may never flip.
//
// Build (x86-64, Linux/macOS with clflush support):
//   cc -O2 -o rowhammer rowhammer.c
//
// Run:
//   ./rowhammer            # default: 256 MiB, 2,000,000 hammers per pair
//   ./rowhammer 512 4000000
//
// Notes
// -----
// * Uses the x86 CLFLUSH instruction; on ARM you would need a cache-clean
//   equivalent (e.g. DC CIVAC) instead.
// * For a serious test you want physically-contiguous, address-mapping-aware
//   pairs (huge pages, knowledge of the DRAM bank/row geometry). This sample
//   keeps things simple and portable at the cost of hit rate.

#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#if defined(__x86_64__) || defined(__i386__)
#include <x86intrin.h>
static inline void flush(volatile void *p) { _mm_clflush((const void *)p); }
static inline void fence(void) { _mm_mfence(); }
#else
#error "This sample uses x86 CLFLUSH; port flush()/fence() for your ISA."
#endif

// Hammer two addresses: read each, flush each from cache, repeat. The flushes
// guarantee the next read misses cache and reactivates the DRAM row.
static void hammer(volatile uint64_t *a, volatile uint64_t *b, uint64_t iters) {
    for (uint64_t i = 0; i < iters; i++) {
        (void)*a;
        (void)*b;
        flush((void *)a);
        flush((void *)b);
        fence();
    }
}

// Scan the buffer for any bit that is not set; report flips.
static uint64_t count_flips(const uint8_t *buf, size_t bytes) {
    uint64_t flips = 0;
    for (size_t i = 0; i < bytes; i++) {
        uint8_t v = buf[i];
        if (v != 0xFF) {
            for (int bit = 0; bit < 8; bit++) {
                if (!((v >> bit) & 1)) {
                    flips++;
                    fprintf(stderr, "  bit flip at offset %zu, bit %d\n", i, bit);
                }
            }
        }
    }
    return flips;
}

int main(int argc, char **argv) {
    size_t mib = (argc > 1) ? (size_t)strtoull(argv[1], NULL, 10) : 256;
    uint64_t iters = (argc > 2) ? strtoull(argv[2], NULL, 10) : 2000000ULL;

    size_t bytes = mib * 1024 * 1024;
    uint8_t *buf = aligned_alloc(4096, bytes);
    if (!buf) {
        perror("aligned_alloc");
        return 1;
    }

    printf("Allocated %zu MiB at %p\n", mib, (void *)buf);
    printf("Filling with all-1s pattern...\n");
    memset(buf, 0xFF, bytes);

    // Choose hammer pairs that straddle the buffer. A real test would derive
    // these from the DRAM row geometry; here we step through with a stride
    // large enough to likely cross row boundaries.
    const size_t stride = 256 * 1024; // 256 KiB apart
    size_t pairs = 0, total_flips = 0;

    struct timespec t0;
    clock_gettime(CLOCK_MONOTONIC, &t0);

    for (size_t off = 0; off + 2 * stride < bytes; off += stride) {
        volatile uint64_t *a = (volatile uint64_t *)(buf + off);
        volatile uint64_t *b = (volatile uint64_t *)(buf + off + stride);
        hammer(a, b, iters);
        pairs++;
        if (pairs % 64 == 0) {
            printf("  hammered %zu pairs...\n", pairs);
        }
    }

    struct timespec t1;
    clock_gettime(CLOCK_MONOTONIC, &t1);
    double secs = (t1.tv_sec - t0.tv_sec) + (t1.tv_nsec - t0.tv_nsec) / 1e9;

    printf("Hammered %zu pairs in %.1f s. Scanning for flips...\n", pairs, secs);
    total_flips = count_flips(buf, bytes);

    if (total_flips == 0) {
        printf("No bit flips detected. Try more iterations, more memory, or "
               "a different stride.\n");
    } else {
        printf("DETECTED %zu bit flip(s) — this memory is susceptible.\n",
               total_flips);
    }

    free(buf);
    return 0;
}
