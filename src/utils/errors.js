export class AppError extends Error {
  constructor(code, message, details = {}, suggestion = '') {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.suggestion = suggestion;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      suggestion: this.suggestion,
      timestamp: this.timestamp
    };
  }
}

export class ValidationError extends AppError {
  constructor(message, details = {}, suggestion = '') {
    super('VALIDATION_ERROR', message, details, suggestion);
    this.name = 'ValidationError';
  }
}

export class SecurityError extends AppError {
  constructor(message, details = {}, suggestion = '') {
    super('SECURITY_ERROR', message, details, suggestion);
    this.name = 'SecurityError';
  }
}

export class BrowserError extends AppError {
  constructor(message, details = {}, suggestion = '') {
    super('BROWSER_ERROR', message, details, suggestion);
    this.name = 'BrowserError';
  }
}

export class SectionDetectionError extends AppError {
  constructor(message, details = {}, suggestion = '') {
    super('SECTION_DETECTION_ERROR', message, details, suggestion);
    this.name = 'SectionDetectionError';
  }
}
