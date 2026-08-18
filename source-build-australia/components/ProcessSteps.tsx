import { FileText, Search, Truck } from 'lucide-react'

const steps = [
  {
    number: '01',
    icon: FileText,
    title: 'You Brief Us',
    description:
      'Share your product specs, quantities, project timeline, and site requirements. The more detail you give us, the sharper the proposal.',
  },
  {
    number: '02',
    icon: Search,
    title: 'We Source It',
    description:
      'Our team works directly with vetted Chinese manufacturers to match your specification. We handle QC, compliance checking, and logistics.',
  },
  {
    number: '03',
    icon: Truck,
    title: 'We Deliver It',
    description:
      'Products arrive on time, to spec, and backed by our Complete Satisfaction Supply Guarantee. No surprises. No excuses.',
  },
]

export default function ProcessSteps() {
  return (
    <section className="py-20 bg-offwhite">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-black text-navy tracking-tight mb-4">
            How It Works
          </h2>
          <p className="text-slate text-lg max-w-2xl mx-auto">
            Three steps. One partner. Products delivered to your site, to spec.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connector line on desktop */}
          <div className="hidden md:block absolute top-12 left-1/4 right-1/4 h-0.5 bg-gold/30" />

          {steps.map((step) => (
            <div key={step.number} className="relative bg-white rounded-xl p-8 shadow-sm border border-navy/5 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-navy mb-5 mx-auto">
                <step.icon size={24} className="text-gold" />
              </div>
              <span className="text-gold/50 text-xs font-bold uppercase tracking-widest block mb-2">{step.number}</span>
              <h3 className="text-navy text-xl font-bold mb-3">{step.title}</h3>
              <p className="text-slate text-sm leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
