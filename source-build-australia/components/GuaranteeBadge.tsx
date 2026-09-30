import { Shield } from 'lucide-react'

export default function GuaranteeBadge() {
  return (
    <div className="bg-gold py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center gap-3">
        <Shield size={20} className="text-navy flex-shrink-0" />
        <p className="text-navy text-sm sm:text-base font-semibold text-center">
          Complete Satisfaction Supply Guarantee — backs every proposal we make
        </p>
        <Shield size={20} className="text-navy flex-shrink-0 hidden sm:block" />
      </div>
    </div>
  )
}
