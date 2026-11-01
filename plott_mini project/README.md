# Plott — Supabase version

## Files
- `index.html` — main dashboard and all clickable workspace tabs
- `login.html` — email/password sign-in
- `register.html` — student registration
- `css/styles.css` — responsive design and light/dark themes
- `js/config.js` — Supabase URL and anon-key placeholders
- `js/auth.js` — browser-only demo login; Supabase registration is enabled after configuration
- `js/app.js` — tasks, focus timer, assignments, classes, videos, submissions, roles, theme preference
- `supabase/schema.sql` — tables, indexes, signup trigger and row-level security policies
- `supabase/README_SUPABASE.md` — setup and deployment notes


## Setup
1. Create a Supabase project.
2. Run `supabase/schema.sql` in SQL Editor.
3. Paste Project URL and anon/public key into `js/config.js`.
4. Create a Student account at `register.html`.
5. Promote the first trusted admin from the SQL Editor as explained in `supabase/README_SUPABASE.md`.
6. Deploy the folder to a static host over HTTPS.

Demo sign-in does not verify credentials and stores a temporary demo profile in browser local storage. It is for interface preview only, not secure authentication. Supabase Auth should be configured for real users. Public registration can only create Student accounts. Admin account creation requires a secure Edge Function, described in the setup guide.

## Key role rules
- Student: create personal tasks, complete assigned tasks, join classes, submit assignments.
- Teacher: create classes and assignments, assign tasks to students, edit tasks they assigned, view submissions and grade work.
- Admin: manage user roles and view logs. Admin is not allowed to create or complete tasks.

## Notes
This is a frontend starter with a Supabase schema and RLS policies, not a fully audited production application. Test and review RLS policies carefully before using real student records. File upload bytes are not handled by this version; submission records store a label only.\n\n### Demo mode\nSign in with any email and password, then choose Student or Teacher to preview role-specific pages. This is a browser-only demo and is not secure authentication. Teachers can assign YouTube links; students can select a local video file for a temporary browser preview. Real file storage and cross-user assignment delivery require Supabase Storage/database configuration. The page canvas uses a light-blue background; day/night mode remains available.\n\nDemo sign-in also asks for a role-specific ID: Student ID, Teacher ID, or Admin ID. The selected role and ID are stored in the local demo profile; this does not validate identity.\n
Teacher demo permissions are limited to providing study videos and assigning them to students. Task creation, coursework creation, class creation, and submission review controls are hidden in this prototype.

Demo login uses email, password, and role selection only; role-specific ID fields are not required.
