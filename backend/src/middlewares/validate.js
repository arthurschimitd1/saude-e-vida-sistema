import { validationResult } from 'express-validator';

const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const extractedErrors = [];
    errors.array().map(err => extractedErrors.push({ [err.path ?? err.param ?? 'campo']: err.msg }));

    return res.status(422).json({
      errors: extractedErrors,
    });
  };
};

export default validate;  // Mudança de module.exports para export default