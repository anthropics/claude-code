import Link from 'next/link'
import Image from 'next/image'
import { Shield, Phone, Mail, MapPin } from 'lucide-react'

const productLinks = [
  { href: '/products/stone-benchtops-vanities', label: 'Stone Benchtops & Vanities' },
  { href: '/products/windows-glazing-aluminium', label: 'Windows & Glazing' },
  { href: '/products/cabinetry-joinery', label: 'Cabinetry & Joinery' },
  { href: '/products/tiles-surface-finishes', label: 'Tiles & Surfaces' },
  { href: '/products/doors-hardware-access', label: 'Doors & Hardware' },
  { href: '/products', label: 'View All Products →' },
]

export default function Footer() {
  return (
    <footer className="bg-navy text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <Image
              src="/logo-white.svg"
              alt="Source Build Australia"
              width={180}
              height={34}
              className="h-8 w-auto mb-4"
            />
            <p className="text-white/60 text-sm leading-relaxed mt-4">
              Australia&apos;s specialist building product supply partner. Direct from China, delivered Australia-wide.
            </p>
            <div className="mt-6 flex items-start gap-2 text-gold text-sm">
              <Shield size={16} className="mt-0.5 flex-shrink-0" />
              <span>Complete Satisfaction Supply Guarantee</span>
            </div>
          </div>

          {/* Products */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gold mb-4">Products</h3>
            <ul className="space-y-2">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-white/60 hover:text-white text-sm transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gold mb-4">Company</h3>
            <ul className="space-y-2">
              {[
                { href: '/about', label: 'About Us' },
                { href: '/contact', label: 'Get a Proposal' },
                { href: '/contact', label: 'Brief Us' },
              ].map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-white/60 hover:text-white text-sm transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gold mb-4">Contact</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-sm text-white/60">
                <Phone size={14} className="mt-0.5 flex-shrink-0" />
                <span>[phone]</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-white/60">
                <Mail size={14} className="mt-0.5 flex-shrink-0" />
                <span>[email]</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-white/60">
                <MapPin size={14} className="mt-0.5 flex-shrink-0" />
                <span>[address], Australia</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-10 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-white/40 text-xs">
            &copy; {new Date().getFullYear()} Source Build Australia. All rights reserved.
          </p>
          <p className="text-white/40 text-xs">
            ABN: [ABN] &nbsp;|&nbsp; sourcebuildaustralia.com.au
          </p>
        </div>
      </div>
    </footer>
  )
}
