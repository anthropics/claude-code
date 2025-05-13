/**
 * Claude Schema UI
 * 
 * Main entry point for schema-driven UI components
 */

// Export form components
export { 
  SchemaForm,
  Form,
  FormField,
  StringField,
  NumberField,
  BooleanField,
  SelectField,
  ArrayField,
  ColorField,
  SchemaFormGenerator
} from './components/form';

// Export profile components
export {
  AboutProfileForm,
  ProfilePage,
  ProfileProvider,
  useProfile
} from './components/profile';

// Export memory components
export {
  MemoryProvider,
  useMemory,
  MemoryProfileForm,
  ProfileHistory
} from './components/profile';

// Export color schema components
export {
  ColorSchemaForm
} from './components/form';

// Export adapters
export {
  createFrameworkAdapter,
  standaloneAdapter
} from './adapters';

// Export utility functions
export {
  validateSchema,
  generateFormFromSchema,
  mergeUiSchema
} from './utils/schema';

// Export memory utility
export { default as memory } from './utils/memory';