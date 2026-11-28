import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, ArrowLeft, FileText } from 'lucide-react'
import GuaranteeBadge from '@/components/GuaranteeBadge'
import { getProduct, products } from '@/lib/products'

interface Props {
  params: Promise<{ category: string }>
}

export async function generateStaticParams() {
  return products.map((p) => ({ category: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params
  const product = getProduct(category)
  if (!product) return {}
  return {
    title: product.title,
    description: product.description,
  }
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params
  const product = getProduct(category)
  if (!product) notFound()

  return (
    <>
      {/* Hero */}
      <section className="bg-navy py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 text-white/50 hover:text-white text-sm mb-8 transition-colors"
          >
            <ArrowLeft size={14} /> All Products
          </Link>
          <span className="text-gold text-sm font-semibold uppercase tracking-widest block mb-4">
            Product Category
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-4 max-w-3xl">
            {product.title}
          </h1>
          <p className="text-gold text-xl font-semibold mb-6">{product.tagline}</p>
          <p className="text-white/70 text-lg max-w-2xl mb-8 leading-relaxed">
            {product.description}
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

      {/* Key Products */}
      <section className="py-16 bg-offwhite">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-navy mb-8">What We Supply</h2>
              <ul className="space-y-4">
                {product.keyItems.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle size={20} className="text-gold flex-shrink-0 mt-0.5" />
                    <span className="text-nearblack font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-sm border border-navy/5">
              <h2 className="text-xl font-bold text-navy mb-3">Brief Us on This Category</h2>
              <p className="text-slate text-sm leading-relaxed mb-6">
                Tell us your specifications, quantities, and project timeline. We&apos;ll come back with a
                supply proposal within 1 business day, backed by our Complete Satisfaction Guarantee.
              </p>
              <div className="space-y-3 mb-6">
                {[
                  'Direct China factory pricing',
                  'Customised to your spec',
                  'Australia-wide delivery',
                  'Complete Satisfaction Guarantee',
                ].map((point) => (
                  <div key={point} className="flex items-center gap-2 text-sm text-nearblack">
                    <CheckCircle size={15} className="text-gold flex-shrink-0" />
                    {point}
                  </div>
                ))}
              </div>
              <Link
                href="/contact"
                className="block text-center bg-navy hover:bg-navy-light text-white font-bold px-6 py-3.5 rounded transition-colors"
              >
                Start Your Brief
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Related links */}
      <section className="py-12 bg-white border-t border-navy/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <p className="text-slate text-sm">
            Looking for other product categories?
          </p>
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 text-navy font-semibold text-sm hover:text-gold transition-colors"
          >
            <ArrowLeft size={14} /> Browse All 16 Categories
          </Link>
        </div>
      </section>
    </>
  )
}
