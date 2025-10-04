// Middleware for authentication and role-based access

export function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  next();
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.userId || req.session.role !== role) {
      return res.status(403).send("Forbidden: Insufficient permissions");
    }
    next();
  };
}
