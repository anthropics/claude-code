import Link from 'next/link'
import { ArrowRight, FileText } from 'lucide-react'

export default function HeroSection() {
  return (
    <section className="bg-navy py-20 sm:py-28 relative overflow-hidden">
      {/* Subtle background texture */}
      <div className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            #ffffff 0px,
            #ffffff 1px,
            transparent 1px,
            transparent 60px
          )`,
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          {/* Eyebrow */}
          <span className="inline-block text-gold text-sm font-semibold uppercase tracking-widest mb-6">
            China to Australia-wide
          </span>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight tracking-tight mb-6">
            Australia&apos;s Specialist{' '}
            <span className="text-gold">Building Product</span>{' '}
            Supply Partner
          </h1>

          {/* Model statement */}
          <div className="flex flex-wrap gap-2 sm:gap-0 items-center mb-8">
            {['You brief us', 'We source it', 'We deliver it'].map((step, i) => (
              <div key={step} className="flex items-center">
                <span className="text-white text-lg sm:text-xl font-bold">{step}</span>
                {i < 2 && (
                  <ArrowRight size={18} className="mx-3 text-gold flex-shrink-0" />
                )}
              </div>
            ))}
          </div>

          <p className="text-white/70 text-lg leading-relaxed mb-10 max-w-2xl">
            We source premium building products direct from China and deliver them to construction
            sites and projects across Australia. One brief. One partner. Complete satisfaction, guaranteed.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 bg-gold hover:bg-gold-light text-navy font-bold px-8 py-4 rounded text-base transition-colors"
            >
              <FileText size={18} />
              Get a Supply Proposal
            </Link>
            <Link
              href="/products"
              className="inline-flex items-center justify-center gap-2 border-2 border-white/30 hover:border-white text-white font-semibold px-8 py-4 rounded text-base transition-colors"
            >
              View All Products
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
