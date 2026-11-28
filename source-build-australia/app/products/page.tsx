import type { Metadata } from 'next'
import GuaranteeBadge from '@/components/GuaranteeBadge'
import ProductCard from '@/components/ProductCard'
import { products, getFeaturedProducts } from '@/lib/products'
import Link from 'next/link'
import { FileText } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Products',
  description:
    'Browse all 16 building product categories sourced direct from China and delivered Australia-wide by Source Build Australia.',
}

export default function ProductsPage() {
  const featured = getFeaturedProducts()
  const remaining = products.filter((p) => !p.featured)

  return (
    <>
      {/* Hero */}
      <section className="bg-navy py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="text-gold text-sm font-semibold uppercase tracking-widest block mb-4">
            16 Product Categories
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-4">
            Building Products,<br />Sourced for You
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mb-8">
            We source premium building products direct from China across 16 specialist categories.
            Brief us on what you need — or browse below to start a conversation.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 bg-gold hover:bg-gold-light text-navy font-bold px-7 py-3.5 rounded transition-colors"
          >
            <FileText size={16} />
            Get a Supply Proposal
          </Link>
        </div>
      </section>

      <GuaranteeBadge />

      <section className="py-16 bg-offwhite">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Featured */}
          <h2 className="text-lg font-bold text-navy uppercase tracking-wider mb-5">Top Categories</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
            {featured.map((product) => (
              <ProductCard key={product.slug} product={product} featured />
            ))}
          </div>

          {/* All remaining */}
          <h2 className="text-lg font-bold text-navy uppercase tracking-wider mb-5">All Categories</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {remaining.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-navy">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-black text-white mb-4">Can&apos;t find what you need?</h2>
          <p className="text-white/70 text-lg mb-8">
            Brief us. If it goes into a building, we can source it — even if it&apos;s not listed here.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 bg-gold hover:bg-gold-light text-navy font-bold px-8 py-4 rounded transition-colors"
          >
            Brief Us
          </Link>
        </div>
      </section>
    </>
  )
}
