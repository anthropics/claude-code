import type { Metadata } from 'next'
import { Phone, Mail, MapPin, Clock } from 'lucide-react'
import GuaranteeBadge from '@/components/GuaranteeBadge'
import EnquiryForm from '@/components/EnquiryForm'

export const metadata: Metadata = {
  title: 'Get a Supply Proposal',
  description:
    'Brief us on what you need. Source Build Australia will respond with a supply proposal within 1 business day, backed by our Complete Satisfaction Supply Guarantee.',
}

const contactDetails = [
  { icon: Phone, label: 'Phone', value: '[phone]' },
  { icon: Mail, label: 'Email', value: '[email]' },
  { icon: MapPin, label: 'Address', value: '[address], Australia' },
  { icon: Clock, label: 'Response time', value: 'Within 1 business day' },
]

export default function ContactPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-navy py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="text-gold text-sm font-semibold uppercase tracking-widest block mb-4">
            Get in Touch
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-4">
            Brief Us
          </h1>
          <p className="text-white/70 text-lg max-w-xl">
            Tell us what you need and we&apos;ll come back with a supply proposal within 1 business day.
            Every proposal is backed by our Complete Satisfaction Supply Guarantee.
          </p>
        </div>
      </section>

      <GuaranteeBadge />

      <section className="py-16 bg-offwhite">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Form */}
            <div className="lg:col-span-2 bg-white rounded-xl p-8 shadow-sm border border-navy/5">
              <h2 className="text-2xl font-black text-navy mb-2">Submit Your Brief</h2>
              <p className="text-slate text-sm mb-8">
                The more detail you give us, the sharper the proposal. Include specs, quantities, site location, and timeline.
              </p>
              <EnquiryForm />
            </div>

            {/* Contact details sidebar */}
            <div className="space-y-6">
              <div className="bg-navy rounded-xl p-8 text-white">
                <h3 className="font-bold text-lg mb-6">Contact Details</h3>
                <ul className="space-y-5">
                  {contactDetails.map((item) => (
                    <li key={item.label} className="flex items-start gap-3">
                      <div className="inline-flex items-center justify-center w-8 h-8 rounded bg-white/10 flex-shrink-0">
                        <item.icon size={14} className="text-gold" />
                      </div>
                      <div>
                        <p className="text-white/50 text-xs mb-0.5">{item.label}</p>
                        <p className="text-white text-sm font-medium">{item.value}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-gold/10 border border-gold/30 rounded-xl p-6">
                <h3 className="font-bold text-navy mb-3">Complete Satisfaction Supply Guarantee</h3>
                <p className="text-slate text-sm leading-relaxed">
                  Every supply proposal we make is backed by our Complete Satisfaction Supply Guarantee.
                  If it&apos;s not right — product, spec, timing, or delivery — we make it right. No exceptions.
                </p>
              </div>

              <div className="bg-white rounded-xl p-6 border border-navy/5">
                <h3 className="font-bold text-navy mb-3">What happens next?</h3>
                <ol className="space-y-3">
                  {[
                    'We review your brief (usually same day)',
                    'We contact our manufacturing partners',
                    'We send you a detailed supply proposal',
                    'You approve — we get to work',
                  ].map((step, i) => (
                    <li key={step} className="flex gap-3 text-sm text-slate">
                      <span className="font-bold text-gold flex-shrink-0">{i + 1}.</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
