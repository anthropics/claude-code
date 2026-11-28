import Link from 'next/link'
import {
  Gem, Square, LayoutGrid, Grid3X3, DoorOpen, Home, Droplets, Bath,
  Layers, Wrench, Building2, Wind, Lightbulb, TreePine, Box, Cog, ArrowRight
} from 'lucide-react'
import type { Product } from '@/lib/products'

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Gem, Square, LayoutGrid, Grid3x3: Grid3X3, DoorOpen, Home, Droplets, Bath,
  Layers, Wrench, Building2, Wind, Lightbulb, TreePine, Box, Cog,
}

interface ProductCardProps {
  product: Product
  featured?: boolean
}

export default function ProductCard({ product, featured = false }: ProductCardProps) {
  const Icon = iconMap[product.icon] ?? Box

  return (
    <Link
      href={`/products/${product.slug}`}
      className={`group block rounded-xl border transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${
        featured
          ? 'bg-navy border-navy text-white p-7'
          : 'bg-white border-navy/10 text-nearblack p-6 hover:border-navy/30'
      }`}
    >
      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg mb-4 ${
        featured ? 'bg-gold/20' : 'bg-navy/5 group-hover:bg-navy/10'
      }`}>
        <Icon size={22} className={featured ? 'text-gold' : 'text-navy'} />
      </div>

      {featured && (
        <span className="text-gold text-xs font-semibold uppercase tracking-widest block mb-2">Featured</span>
      )}

      <h3 className={`font-bold text-base leading-snug mb-2 ${featured ? 'text-white' : 'text-navy'}`}>
        {product.title}
      </h3>
      <p className={`text-sm leading-relaxed line-clamp-2 mb-4 ${featured ? 'text-white/70' : 'text-slate'}`}>
        {product.tagline}
      </p>

      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${featured ? 'text-gold' : 'text-navy'}`}>
        View Category <ArrowRight size={12} />
      </span>
    </Link>
  )
}
