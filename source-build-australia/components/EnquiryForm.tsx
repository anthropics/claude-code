'use client'

import { useState } from 'react'
import { Send, CheckCircle } from 'lucide-react'

export default function EnquiryForm() {
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    customerType: '',
    products: '',
    brief: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // In production, wire to your preferred form service (e.g. Formspree, Netlify Forms, or backend API)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CheckCircle size={48} className="text-gold mb-4" />
        <h3 className="text-2xl font-bold text-navy mb-2">Brief Received</h3>
        <p className="text-slate max-w-md">
          Thank you. Our team will review your brief and come back to you with a supply proposal within 1 business day.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-semibold text-navy mb-1.5" htmlFor="name">Full Name *</label>
          <input
            id="name"
            name="name"
            type="text"
            required
            value={form.name}
            onChange={handleChange}
            className="w-full border border-navy/20 rounded px-4 py-2.5 text-sm text-nearblack placeholder:text-slate/50 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
            placeholder="Your full name"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-navy mb-1.5" htmlFor="company">Company *</label>
          <input
            id="company"
            name="company"
            type="text"
            required
            value={form.company}
            onChange={handleChange}
            className="w-full border border-navy/20 rounded px-4 py-2.5 text-sm text-nearblack placeholder:text-slate/50 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
            placeholder="Your company"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-navy mb-1.5" htmlFor="email">Email Address *</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={form.email}
            onChange={handleChange}
            className="w-full border border-navy/20 rounded px-4 py-2.5 text-sm text-nearblack placeholder:text-slate/50 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
            placeholder="you@company.com.au"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-navy mb-1.5" htmlFor="phone">Phone</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            value={form.phone}
            onChange={handleChange}
            className="w-full border border-navy/20 rounded px-4 py-2.5 text-sm text-nearblack placeholder:text-slate/50 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
            placeholder="04XX XXX XXX"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-navy mb-1.5" htmlFor="customerType">I am a *</label>
        <select
          id="customerType"
          name="customerType"
          required
          value={form.customerType}
          onChange={handleChange}
          className="w-full border border-navy/20 rounded px-4 py-2.5 text-sm text-nearblack focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold bg-white"
        >
          <option value="">Select your role...</option>
          <option>Residential Builder</option>
          <option>Commercial Contractor</option>
          <option>Property Developer</option>
          <option>Trade Contractor</option>
          <option>Site / Project Manager</option>
          <option>Civil Contractor</option>
          <option>Other</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-navy mb-1.5" htmlFor="products">Products Needed</label>
        <input
          id="products"
          name="products"
          type="text"
          value={form.products}
          onChange={handleChange}
          className="w-full border border-navy/20 rounded px-4 py-2.5 text-sm text-nearblack placeholder:text-slate/50 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
          placeholder="e.g. Stone benchtops, porcelain tiles, windows..."
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-navy mb-1.5" htmlFor="brief">Your Brief *</label>
        <textarea
          id="brief"
          name="brief"
          required
          rows={5}
          value={form.brief}
          onChange={handleChange}
          className="w-full border border-navy/20 rounded px-4 py-2.5 text-sm text-nearblack placeholder:text-slate/50 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold resize-none"
          placeholder="Tell us what you need: specifications, quantities, timeline, site location, and any other relevant details..."
        />
      </div>

      <button
        type="submit"
        className="inline-flex items-center gap-2 bg-gold hover:bg-gold-light text-navy font-bold px-8 py-3.5 rounded transition-colors text-sm"
      >
        <Send size={16} />
        Submit Your Brief
      </button>

      <p className="text-slate text-xs mt-3">
        We review every brief within 1 business day. Backed by our Complete Satisfaction Supply Guarantee.
      </p>
    </form>
  )
}
