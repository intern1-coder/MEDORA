# Medora Backend Source Code

This directory contains the TypeScript source code for the Medora Hospital Management System Backend.

## Directory Structure

- `config/`: Environment configuration, database client, logger
- `constants/`: Global HTTP and business constants
- `controllers/`: HTTP request controllers
- `errors/`: Custom typed application errors (`AppError`)
- `middlewares/`: Express middleware (security, validation, error handler, 404)
- `routes/`: Modular Express route definitions
- `services/`: Core business logic decoupled from HTTP transport
- `types/`: Shared TypeScript types and API interfaces
- `utils/`: Reusable helpers and response formatting
- `validators/`: Zod request schemas
- `app.ts`: Express application setup and middleware binding
- `server.ts`: Server startup and graceful shutdown
