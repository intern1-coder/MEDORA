import { AppError, BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError, UnprocessableEntityError, ValidationError } from '../errors/AppError';
import { HTTP_STATUS, ERROR_CODES } from '../constants/http';

describe('AppError Hierarchy', () => {
  it('should properly instantiate base AppError with defaults', () => {
    const error = new AppError('Internal test failure');
    expect(error.message).toBe('Internal test failure');
    expect(error.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    expect(error.errorCode).toBe(ERROR_CODES.INTERNAL_ERROR);
    expect(error.isOperational).toBe(true);
  });

  it('should instantiate BadRequestError with correct status and code', () => {
    const error = new BadRequestError('Bad input', { field: 'name' });
    expect(error.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(error.errorCode).toBe(ERROR_CODES.BAD_REQUEST);
    expect(error.details).toEqual({ field: 'name' });
  });

  it('should instantiate ValidationError with VALIDATION_ERROR code', () => {
    const error = new ValidationError('Invalid fields', [{ path: 'email', message: 'Required' }]);
    expect(error.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(error.errorCode).toBe(ERROR_CODES.VALIDATION_ERROR);
  });

  it('should instantiate UnauthorizedError, ForbiddenError, NotFoundError, ConflictError, and UnprocessableEntityError', () => {
    expect(new UnauthorizedError().statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
    expect(new ForbiddenError().statusCode).toBe(HTTP_STATUS.FORBIDDEN);
    expect(new NotFoundError().statusCode).toBe(HTTP_STATUS.NOT_FOUND);
    expect(new ConflictError().statusCode).toBe(HTTP_STATUS.CONFLICT);
    expect(new UnprocessableEntityError().statusCode).toBe(HTTP_STATUS.UNPROCESSABLE_ENTITY);
  });
});
