import type { Metadata } from 'next'
import Link from 'next/link'
import { Shield, Globe, Users, ArrowRight } from 'lucide-react'
import GuaranteeBadge from '@/components/GuaranteeBadge'

export const metadata: Metadata = {
  title: 'About',
  description:
    'Learn about Source Build Australia — Australia\'s specialist building product supply partner sourcing direct from China.',
}

const values = [
  {
    icon: Shield,
    title: 'Guarantee-First',
    description:
      'Our Complete Satisfaction Supply Guarantee isn\'t marketing language — it\'s a commercial commitment that backs every proposal we make. If it\'s not right, we make it right.',
  },
  {
    icon: Globe,
    title: 'Direct Relationships',
    description:
      'We have established, direct relationships with vetted manufacturers across China. No brokers, no middlemen — which means better pricing and tighter quality control for your projects.',
  },
  {
    icon: Users,
    title: 'Partner Mentality',
    description:
      'We\'re not a catalogue. We\'re a supply partner. We invest time in understanding each project brief so we can source the right product, not just any product.',
  },
]

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-navy py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <span className="text-gold text-sm font-semibold uppercase tracking-widest block mb-4">
              About Us
            </span>
            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-6">
              Australia&apos;s Specialist<br />Building Product Supply Partner
            </h1>
            <p className="text-white/70 text-lg leading-relaxed">
              Source Build Australia was built for builders, developers, and trade contractors who need a smarter,
              more reliable way to procure building products — direct from source, delivered to site.
            </p>
          </div>
        </div>
      </section>

      <GuaranteeBadge />

      {/* Story */}
      <section className="py-20 bg-offwhite">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-black text-navy mb-6">
                Built for the Building Industry
              </h2>
              <div className="space-y-5 text-slate text-base leading-relaxed">
                <p>
                  Source Build Australia was founded with a single purpose: to give Australian builders, developers,
                  and contractors direct access to premium building products from China — without the complexity,
                  unreliability, and cost that typically comes with international procurement.
                </p>
                <p>
                  Our model is simple. You brief us on what you need. We source it from our network of vetted
                  Chinese manufacturers. We manage quality control, compliance, freight, and delivery. You get
                  the right product, on time, backed by a guarantee.
                </p>
                <p>
                  We work across 16 product categories — from stone benchtops and aluminium windows to cabinetry,
                  tiles, doors, roofing, and structural products — supplying projects from single-dwelling residential
                  builds to large commercial and civil contracts.
                </p>
              </div>
            </div>

            <div className="bg-navy rounded-2xl p-10 text-white">
              <h3 className="text-gold text-sm font-semibold uppercase tracking-widest mb-6">Our Model</h3>
              <div className="space-y-6">
                {[
                  { step: '01', title: 'You Brief Us', desc: 'Share your spec, quantities, and timeline.' },
                  { step: '02', title: 'We Source It', desc: 'Direct from vetted Chinese manufacturers. QC included.' },
                  { step: '03', title: 'We Deliver It', desc: 'To site, on time. Satisfaction guaranteed.' },
                ].map((item) => (
                  <div key={item.step} className="flex gap-4">
                    <span className="text-gold/50 text-2xl font-black leading-none">{item.step}</span>
                    <div>
                      <p className="font-bold text-white">{item.title}</p>
                      <p className="text-white/60 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-black text-navy mb-12 text-center">How We Operate</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {values.map((value) => (
              <div key={value.title} className="bg-offwhite rounded-xl p-8">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-navy mb-5">
                  <value.icon size={22} className="text-gold" />
                </div>
                <h3 className="text-navy font-bold text-lg mb-3">{value.title}</h3>
                <p className="text-slate text-sm leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-navy">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-black text-white mb-4">Ready to work with us?</h2>
          <p className="text-white/70 text-lg mb-8">
            Brief us on your next project and we&apos;ll have a proposal back to you within 1 business day.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-gold hover:bg-gold-light text-navy font-bold px-8 py-4 rounded transition-colors"
            >
              Get a Supply Proposal <ArrowRight size={16} />
            </Link>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 border-2 border-white/30 hover:border-white text-white font-semibold px-8 py-4 rounded transition-colors"
            >
              View Products
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
