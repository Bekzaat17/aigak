export const initialSchema = `
CREATE TABLE cases (
  id text PRIMARY KEY,
  ordinal bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  body text NOT NULL CHECK (json_typeof(body::json) = 'object')
);
CREATE TABLE templates (
  id text PRIMARY KEY,
  ordinal bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  name text NOT NULL,
  sha256 text NOT NULL
);
CREATE INDEX templates_sha256_idx ON templates(sha256);
CREATE SEQUENCE case_number_seq;
`;
