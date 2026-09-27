import { userSchema } from './userSchema.js';
import { loginSchema } from './loginSchema.js';
import { emailSchema } from './emailSchema.js';
import { documentSchema } from './document.js';
import { phoneCallSchema } from './phoneCallSchema.js';
import { changePasswordSchema } from './changePasswordSchema.js';

// Customers, leads, properties, deals, meetings and tasks keep their schema
// next to their form (views/admin/*/…Fields.js)
export {
    userSchema,
    loginSchema,
    emailSchema,
    documentSchema,
    phoneCallSchema,
    changePasswordSchema,
};
