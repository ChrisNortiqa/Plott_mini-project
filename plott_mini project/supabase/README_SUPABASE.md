# Connect Plott to Supabase

## 1. Create the project
1. Create a Supabase project.
2. In **SQL Editor**, run `schema.sql`.
3. Open **Project Settings → API** and copy the Project URL and anon/public key.
4. Paste them into `js/config.js`. Never use the `service_role` key in browser code.

## 2. Enable authentication
In **Authentication → Providers → Email**, enable email/password sign-in. Email confirmation can be enabled or disabled for development. The signup trigger automatically creates a Student profile. Public registration cannot select a privileged role.

## 3. Admin user creation
The Admin page calls a Supabase Edge Function named `admin-create-user`. This function must be deployed using the Supabase server-side service-role secret (stored only as an Edge Function secret), verify the caller's authenticated user is an Admin, validate inputs, create the user through the Supabase Admin Auth API, and assign the allowed role. Do not implement this by exposing the service-role key in the browser. Until you deploy the function, admins can see users but the create-user action will show a helpful error.

To create the first Admin safely: sign up through the site, then in the Supabase SQL editor manually promote the trusted account:
`update public.profiles set role='Admin' where email='your-admin-email@example.com';`
Only do this from the trusted SQL editor.

## 4. Notes / expected behavior
- Timer is a browser-side focus timer; it does not need a database table.
- Day/night mode is saved to the user's `profiles.theme`.
- The student task form creates personal tasks. Teachers can assign tasks to students and edit tasks they assigned. Admins cannot create, complete, or delete tasks.
- The current submission form stores a submission label, not the file bytes. Real file upload should use a private Supabase Storage bucket with server-side MIME/signature validation, 25 MB limit, allowed `.pdf`, `.docx`, `.zip` extensions, and policies limiting access to the student and authorized teacher.
- The SQL is a starter schema; review and test policies before production. Do not store real academic data until policies have been audited.

## 5. Deployment
Serve the folder over HTTPS using a static host such as Netlify, Vercel, GitHub Pages, or a web server. Supabase authentication redirect URLs must include the deployed site URL and local development URL.
