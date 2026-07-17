# Changelog

## Unreleased

## 1.8.2

- Fixed Web Push activation on iPhone and iPad by starting the subscription directly from the user action and showing the iOS 16.4 requirement when the platform APIs are unavailable.

## 1.8.1

- Added an immediate-send option for admin Web Push campaigns, with explicit confirmation, delivery tracking and scheduled retry support.
- Added a separate user preference for enabling or disabling administrative app announcements.

## 1.8.0

- Added admin-created Web Push campaigns with device-local scheduling, future campaign editing and cancellation, delivery tracking, and single-device previews.

## 1.7.0

- Added opt-in Web Push notifications for likes, comments, follows and group invitations, including iOS Home Screen guidance, per-device subscriptions and user preferences.
- Added a persistent Supabase notification inbox with database triggers, RLS policies, Realtime updates and an Edge Function delivery pipeline.

## 1.6.1

- Changed feed post sharing to appear as a footer action with separate link and photo sharing options.
- Changed link sharing to copy the post URL before opening the native share dialog.

## 1.6.0

- Added a unified search page for users and restaurants.
- Changed the bottom navigation to replace Groups with Search and move Groups into the More menu.
- Changed the legacy restaurants route to redirect into the unified search page.
- Fixed unified search page translations across supported languages.

## 1.5.1

- Fixed the Burger Calendar week layout so weeks start on Monday.
- Changed Burger Calendar post days to use color intensity instead of visible count badges.
- Changed public user profiles to show all months by default.

## 1.5.0

- Added Burger Calendar page to visualize burger entries by month, including monthly stats and day-level entry details.
- Added a Burger Calendar access card to the dashboard.
- Improved mobile dashboard layout with a collapsible annual summary.
- Changed the expanded mobile annual summary to hide the compact card and show a separate collapse action.
- Added a bouncy animation to the mobile annual summary expand and collapse states.

## 1.4.1

- Added a feature announcement modal for the Burgers to try feed workflow.
- Changed the feature announcement dismissal to persist per user in Supabase.
- Fixed Thai translations in My Top Burgers and the feed title.

## 1.4.0

- Added "Burgers para probar", a private list for restaurant burgers discovered from other users' posts.
- Added feed actions to save burgers as pending or mark them as privately tried without creating public posts.
- Added private tried burger ratings with the selected post photo, including editing and deletion.
- Added private tried burgers to restaurant views and My Top Burgers without affecting post statistics.
- Kept feed burger actions hidden when the viewer already has a post for the same burger.
- Removed burgers from "Burgers para probar" automatically when the user saves a post for the same burger.

## 1.3.2

- Added an in-sheet restaurant review step before creating new restaurants from the add entry flow.
- Improved restaurant autocomplete matching so searches with generic words can still find shorter restaurant names.
- Changed the restaurant review confirmation to create and select the restaurant immediately.
- Prevented saving entries with restaurant text that has not been selected or created in the database.
- Loaded saved profile language and currency preferences when starting a session on a new device.
- Added a back button to the My Top Burgers page that returns to the previous route.

## 1.3.1

- Changed the incomplete profile reminder from a home modal to a dismissible profile suggestion anchored to the navigation bar.
- Fixed the profile suggestion layering so it appears above the add post button.
- Changed the profile suggestion border to match the home filter gradient style.

## 1.3.0

- Added a responsive desktop layout with a wider app shell, sidebar navigation, expanded content grids and desktop-friendly fixed actions.
- Refined the desktop header, add button and More menu positioning.
- Added hover feedback for app buttons, including a desktop-only expanding Add button.

## 1.2.0

- Added Japanese language support and Japanese yen currency support.
- Added complete exchange-rate seeding guidance for all supported currencies.

## 1.1.0

- Added burger profile preferences with translated ideal burger summaries and profile personalization progress.
- Added a centered home reminder modal for users with incomplete profile personalization.
- Added the home feed filters to other users' profile feeds.
- Changed the profile save action to a full-width sticky bar above the bottom navigation.
- Added an unsaved profile changes confirmation when leaving through the bottom navigation.
- Added icons to public burger preference chips.
- Fixed feed photo previews so mobile back closes the photo while manual close no longer navigates through browser history.

## 1.0.2

- Fixed app navigation so changing sections resets the page scroll to the top.

## 1.0.1

- Added post-shaped skeletons while feed and user home posts are loading to avoid flashing the empty state.
- Added skeleton placeholders for annual summary stat card icons and values while the home data is loading.
- Changed My Top Burgers to show the highest recorded price instead of the average price.
- Changed My Top Burgers to show "Price" when a burger has only one recorded price.
- Centered the photo viewer close icon.
- Fixed photo viewer layering so images opened from modals appear above the modal.
- Added a posts modal when selecting a burger in My Top Burgers.
- Reworked the README as detailed technical documentation with public-repository security guidance.

## 1.0.0

- Fixed the bottom navigation More menu layering so homepage filters no longer appear above it.
- Fixed the Add button layering so it stays above the bottom navigation.
- Fixed the More menu layering so it appears above the Add button while open.
