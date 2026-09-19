/**
 * Framer Motion animation variants for Veridis landing page
 * Inspired by Stripe's subtle, professional animations
 */

// Fade in from bottom - Primary scroll-triggered animation
export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.6, ease: "easeOut" },
};

// Fade in from left
export const fadeInLeft = {
  initial: { opacity: 0, x: -20 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.6, ease: "easeOut" },
};

// Fade in from right
export const fadeInRight = {
  initial: { opacity: 0, x: 20 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.6, ease: "easeOut" },
};

// Simple fade
export const fadeIn = {
  initial: { opacity: 0 },
  whileInView: { opacity: 1 },
  viewport: { once: true, margin: "-50px" },
  transition: { duration: 0.5, ease: "easeOut" },
};

// Container for staggered children (feature grids, etc.)
export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

// Child item for staggered animations
export const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

// Scale up animation
export const scaleUp = {
  initial: { opacity: 0, scale: 0.95 },
  whileInView: { opacity: 1, scale: 1 },
  viewport: { once: true, margin: "-50px" },
  transition: { duration: 0.5, ease: "easeOut" },
};

// Button hover - Tesla-style lift
export const buttonHover = {
  whileHover: { scale: 1.02, y: -2 },
  whileTap: { scale: 0.98 },
  transition: { type: "spring", stiffness: 400, damping: 17 },
};

// Card hover
export const cardHover = {
  whileHover: { y: -4, boxShadow: "0 13px 27px -5px rgba(50, 50, 93, 0.15), 0 8px 16px -8px rgba(0, 0, 0, 0.2)" },
  transition: { type: "spring", stiffness: 400, damping: 17 },
};

// Hero badge bounce
export const badgeBounce = {
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay: 0.2 },
};

// Code block typing effect helper
export const typewriter = {
  hidden: { width: 0 },
  visible: {
    width: "100%",
    transition: { duration: 2, ease: "linear" },
  },
};

// Navigation slide down
export const navSlideDown = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: "easeOut" },
};

// Stats counter animation config
export const counterAnimation = {
  initial: { opacity: 0, scale: 0.5 },
  whileInView: { opacity: 1, scale: 1 },
  viewport: { once: true },
  transition: { duration: 0.5, type: "spring", stiffness: 100 },
};
