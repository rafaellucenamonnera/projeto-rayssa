
INSERT INTO profiles (user_id, nome, primeiro_acesso)
VALUES ('c1239543-2329-47f1-a10e-5b9fec8ff1cf', 'Rafael Lucena', false)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO user_roles (user_id, role)
VALUES ('c1239543-2329-47f1-a10e-5b9fec8ff1cf', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
