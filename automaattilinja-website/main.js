/* ============================================
   AutomaattiLinja - Main JavaScript
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initMobileMenu();
    initCallTimer();
    initTranscript();
    initFAQ();
    initScrollReveal();
    initCountUp();
});

/* === Navbar Scroll Effect === */
function initNavbar() {
    const navbar = document.getElementById('navbar');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.scrollY;
        if (currentScroll > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
        lastScroll = currentScroll;
    }, { passive: true });
}

/* === Mobile Menu === */
function initMobileMenu() {
    const toggle = document.getElementById('mobile-menu-toggle');
    const navLinks = document.getElementById('nav-links');

    if (!toggle || !navLinks) return;

    toggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        toggle.classList.toggle('active');
    });

    // Close menu on link click
    navLinks.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            toggle.classList.remove('active');
        });
    });
}

/* === Call Timer Animation === */
function initCallTimer() {
    const timerEl = document.getElementById('call-timer');
    if (!timerEl) return;

    let seconds = 0;
    setInterval(() => {
        seconds++;
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        timerEl.textContent = `${mins}:${secs}`;
    }, 1000);
}

/* === Live Transcript Simulation === */
function initTranscript() {
    const transcriptEl = document.getElementById('call-transcript');
    if (!transcriptEl) return;

    const conversation = [
        { type: 'ai', text: 'Hyvää päivää! LVI-Palvelu Virtanen, miten voin auttaa?', delay: 2000 },
        { type: 'user', text: 'Hei, mulla vuotaa putki keittiössä...', delay: 4500 },
        { type: 'ai', text: 'Ikävä kuulla! Onko vuoto akuutti vai pieni tippuminen?', delay: 3000 },
        { type: 'user', text: 'Aika paljon tulee, ämpärillä kerään', delay: 3500 },
        { type: 'ai', text: 'Selvä, tämä on kiireellinen. Sulkekaa ensin pääsulku. Lähetän putkimiehen teille tänään – mikä on osoitteenne?', delay: 4000 },
        { type: 'user', text: 'Hämeenkatu 15, Tampere', delay: 3000 },
        { type: 'ai', text: 'Kiitos! Putkimies on paikalla klo 14 mennessä. Lähetän vahvistuksen tekstiviestillä. Voinko auttaa muussa?', delay: 4500 },
    ];

    let index = 0;
    let totalDelay = 1500; // Initial delay

    function showMessage(msg) {
        const div = document.createElement('div');
        div.className = `transcript-msg transcript-${msg.type}`;
        div.textContent = msg.text;
        transcriptEl.appendChild(div);
        transcriptEl.scrollTop = transcriptEl.scrollHeight;
    }

    function scheduleMessages() {
        conversation.forEach((msg, i) => {
            setTimeout(() => {
                showMessage(msg);
            }, totalDelay);
            totalDelay += msg.delay;
        });

        // Reset and replay after all messages
        setTimeout(() => {
            transcriptEl.innerHTML = '';
            totalDelay = 1500;
            index = 0;
            scheduleMessages();
        }, totalDelay + 3000);
    }

    scheduleMessages();
}

/* === FAQ Accordion === */
function initFAQ() {
    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        const answer = item.querySelector('.faq-answer');

        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');

            // Close all
            faqItems.forEach(i => {
                i.classList.remove('active');
                const a = i.querySelector('.faq-answer');
                if (a) a.style.maxHeight = '0';
                const q = i.querySelector('.faq-question');
                if (q) q.setAttribute('aria-expanded', 'false');
            });

            // Open clicked if it was closed
            if (!isActive) {
                item.classList.add('active');
                answer.style.maxHeight = answer.scrollHeight + 'px';
                question.setAttribute('aria-expanded', 'true');
            }
        });
    });
}

/* === Scroll Reveal Animation === */
function initScrollReveal() {
    const revealElements = document.querySelectorAll(
        '.problem-card, .demo-card, .benefit-card, .step-card, .testimonial-card, .pricing-card, .faq-item, .comparison-table-wrap'
    );

    revealElements.forEach(el => el.classList.add('reveal'));

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    revealElements.forEach(el => observer.observe(el));
}

/* === Count Up Animation === */
function initCountUp() {
    const statValues = document.querySelectorAll('.hero-stat-value[data-count]');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const target = parseInt(el.dataset.count, 10);
                animateCount(el, 0, target, 2000);
                observer.unobserve(el);
            }
        });
    }, { threshold: 0.5 });

    statValues.forEach(el => observer.observe(el));
}

function animateCount(el, start, end, duration) {
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(start + (end - start) * eased);

        el.textContent = current;

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

/* === Smooth scroll for anchor links === */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            e.preventDefault();
            const offsetTop = target.offsetTop - 80;
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    });
});
