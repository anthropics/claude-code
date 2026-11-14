import {
  Home, Building2, TrendingUp, Wrench, ClipboardList, Truck
} from 'lucide-react'
import type { CustomerSegment } from '@/lib/customers'

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Home, Building2, TrendingUp, Wrench, ClipboardList, Truck,
}

interface CustomerTypesProps {
  segments: CustomerSegment[]
}

export default function CustomerTypes({ segments }: CustomerTypesProps) {
  return (
    <section className="py-20 bg-navy">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-4">
            Who We Serve
          </h2>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            From volume home builders to civil contractors — if you need building products, we can source them.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {segments.map((segment) => {
            const Icon = iconMap[segment.icon] ?? Home
            return (
              <div
                key={segment.id}
                className="bg-white/5 hover:bg-white/10 rounded-xl p-5 text-center transition-colors cursor-default"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gold/15 mb-3">
                  <Icon size={20} className="text-gold" />
                </div>
                <h3 className="text-white text-sm font-bold leading-snug mb-1">{segment.title}</h3>
                <p className="text-white/50 text-xs leading-relaxed hidden lg:block">{segment.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
