export const processingJobs = `
CREATE TABLE processing_jobs (
  case_id text PRIMARY KEY REFERENCES cases(id),
  revision integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','completed')),
  completed_stages text[] NOT NULL DEFAULT '{}',
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX processing_jobs_ready_idx ON processing_jobs(created_at) WHERE status <> 'completed';
`;
