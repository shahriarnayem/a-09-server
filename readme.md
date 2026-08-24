# MediQueue Server

This is the server-side application for MediQueue. It handles authentication, tutor information, session bookings, availability updates, and protected user activities behind the main website.

## Live API

[MediQueue API](https://mediqora-api.vercel.app)

## Key Features

- Provides secure token-based authentication for protected activities.
- Stores and manages tutor profiles with pricing, ratings, descriptions, and available slots.
- Supports searching, sorting, filtering, and limiting tutor results.
- Allows authenticated users to add, update, and remove their own tutor profiles.
- Lets users book available tutoring sessions through protected booking endpoints.
- Prevents users from booking the same tutor more than once.
- Automatically updates the tutor’s available slots after a successful booking.
- Returns consistent success messages, validation responses, and error information.
- Includes a health endpoint for checking the server and database connection.