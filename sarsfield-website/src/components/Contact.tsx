"use client";

import FadeIn from "./FadeIn";

const hours = [
  { day: "Monday", time: "Closed" },
  { day: "Tuesday", time: "Closed" },
  { day: "Wednesday", time: "12:00 PM \u2013 9:00 PM" },
  { day: "Thursday", time: "12:00 PM \u2013 9:00 PM" },
  { day: "Friday", time: "12:00 PM \u2013 10:00 PM" },
  { day: "Saturday", time: "12:00 PM \u2013 10:00 PM" },
  { day: "Sunday", time: "12:00 PM \u2013 8:00 PM" },
];

export default function Contact() {
  return (
    <section id="contact" className="bg-dark-surface px-8 py-24">
      <div className="mx-auto max-w-[1200px]">
        <FadeIn>
          <div className="mb-4 text-[0.75rem] font-medium tracking-[3px] uppercase text-amber">
            Find Us
          </div>
          <h2 className="mb-6 font-serif text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.2] text-cream">
            Get in Touch
          </h2>
        </FadeIn>

        <div className="mt-12 grid gap-8 md:grid-cols-2 md:gap-16">
          <FadeIn>
            {/* Location */}
            <div className="mb-8">
              <h4 className="mb-3 font-serif text-[1.1rem] text-amber">
                Location
              </h4>
              <p className="text-[0.95rem] leading-[1.8] text-text-secondary">
                1980 Terrys Creek Road
                <br />
                Port Williams, Nova Scotia
              </p>
            </div>

            {/* Contact info */}
            <div className="mb-8">
              <h4 className="mb-3 font-serif text-[1.1rem] text-amber">
                Contact
              </h4>
              <p className="text-[0.95rem] leading-[1.8]">
                <a
                  href="tel:9025425555"
                  className="text-text-secondary no-underline transition-colors hover:text-amber"
                >
                  (902) 542-5555
                </a>
                <br />
                <a
                  href="mailto:info@theportpub.com"
                  className="text-text-secondary no-underline transition-colors hover:text-amber"
                >
                  info@theportpub.com
                </a>
              </p>
            </div>

            {/* Hours */}
            <div>
              <h4 className="mb-3 font-serif text-[1.1rem] text-amber">
                Hours
              </h4>
              <table className="w-full border-collapse">
                <tbody>
                  {hours.map((h) => (
                    <tr key={h.day}>
                      <td className="border-b border-dark-border py-1.5 text-[0.9rem] text-text-secondary">
                        {h.day}
                      </td>
                      <td className="border-b border-dark-border py-1.5 text-right text-[0.9rem] text-cream">
                        {h.time}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[0.8rem] text-text-dim">
                Hours may vary seasonally. Please call ahead to confirm.
              </p>
            </div>
          </FadeIn>

          {/* Map */}
          <FadeIn>
            <div className="overflow-hidden rounded-lg border border-dark-border bg-dark-elevated transition-all [&:hover_iframe]:brightness-90 [&:hover_iframe]:grayscale-30">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2836.5!2d-64.4072!3d45.0862!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDXCsDA1JzEwLjMiTiA2NMKwMjQnMjUuOSJX!5e0!3m2!1sen!2sca!4v1700000000000!5m2!1sen!2sca"
                className="h-[400px] w-full border-0 brightness-80 grayscale-70 transition-all"
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Map showing The Sarsfield Group location in Port Williams, Nova Scotia"
              />
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
