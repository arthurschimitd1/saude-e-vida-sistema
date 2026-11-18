const masterOnly = (req, res, next) => {
  const isMaster = req.user?.tipo === 'MASTER' || req.user?.email === 'admin@master.com';

  if (!isMaster) {
    return res.status(403).json({ error: 'Acesso restrito ao usuário MASTER' });
  }

  return next();
};

export default masterOnly;
