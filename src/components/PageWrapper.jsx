import { motion } from 'framer-motion';

/**
 * PageWrapper — wraps every page with:
 * - Page transition animation (fade + slight y slide)
 * - Consistent min-height and top padding (navbar clearance)
 * - Subtle grid-bg pattern on all pages
 */
export default function PageWrapper({ children, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`min-h-screen pt-16 grid-bg ${className}`}
    >
      {children}
    </motion.div>
  );
}
