import Link from 'next/link'
import { CheckCircle, Globe, Shield, Star } from 'lucide-react'
import HeroSection from '@/components/HeroSection'
import GuaranteeBadge from '@/components/GuaranteeBadge'
import ProcessSteps from '@/components/ProcessSteps'
import ProductCard from '@/components/ProductCard'
import CustomerTypes from '@/components/CustomerTypes'
import { products, getFeaturedProducts } from '@/lib/products'
import { customerSegments } from '@/lib/customers'

const differentiators = [
  {
    icon: Globe,
    title: 'Direct China Sourcing',
    description:
      'We work directly with vetted manufacturers in China, cutting out the middlemen and delivering better pricing to your projects.',
  },
  {
    icon: Shield,
    title: 'Complete Satisfaction Guarantee',
    description:
      'Every proposal we make is backed by our Complete Satisfaction Supply Guarantee. If it\'s not right, we fix it.',
  },
  {
    icon: CheckCircle,
    title: 'Australia-Wide Delivery',
    description:
      'We deliver to construction sites and project addresses across every state and territory in Australia.',
  },
  {
    icon: Star,
    title: 'Dedicated Supply Partner',
    description:
      'We\'re not a catalogue. We\'re a supply partner. Brief us on what you need and we go to work for you.',
  },
]

export default function HomePage() {
  const featured = getFeaturedProducts()
  const remaining = products.filter((p) => !p.featured)

  return (
    <>
      <HeroSection />
      <GuaranteeBadge />
      <ProcessSteps />

      {/* Products Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-navy tracking-tight mb-4">
              16 Product Categories
            </h2>
            <p className="text-slate text-lg max-w-2xl mx-auto">
              From stone benchtops to structural steel — if it goes into a building, we can source it.
            </p>
          </div>

          {/* Featured four */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
            {featured.map((product) => (
              <ProductCard key={product.slug} product={product} featured />
            ))}
          </div>

          {/* Remaining 12 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {remaining.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>

          <div className="text-center">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 border-2 border-navy text-navy hover:bg-navy hover:text-white font-semibold px-8 py-3 rounded transition-colors"
            >
              Explore All Product Categories
            </Link>
          </div>
        </div>
      </section>

      <CustomerTypes segments={customerSegments} />

      {/* Why Source Build */}
      <section className="py-20 bg-offwhite">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-navy tracking-tight mb-4">
              Why Source Build Australia
            </h2>
            <p className="text-slate text-lg max-w-2xl mx-auto">
              A supply partner that works as hard as you do.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {differentiators.map((item) => (
              <div key={item.title} className="bg-white rounded-xl p-7 shadow-sm border border-navy/5">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-navy mb-5">
                  <item.icon size={22} className="text-gold" />
                </div>
                <h3 className="text-navy font-bold text-base mb-2">{item.title}</h3>
                <p className="text-slate text-sm leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-navy">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-4">
            Ready to Brief Us?
          </h2>
          <p className="text-white/70 text-lg mb-10 max-w-2xl mx-auto">
            Tell us what you need. We&apos;ll come back with a supply proposal within 1 business day,
            backed by our Complete Satisfaction Supply Guarantee.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center bg-gold hover:bg-gold-light text-navy font-bold px-10 py-4 rounded text-base transition-colors"
            >
              Get a Supply Proposal
            </Link>
            <Link
              href="/products"
              className="inline-flex items-center justify-center border-2 border-white/30 hover:border-white text-white font-semibold px-10 py-4 rounded text-base transition-colors"
            >
              Browse Products
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
