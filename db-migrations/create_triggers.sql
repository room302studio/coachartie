-- Create triggers to log changes in the todos table
CREATE TRIGGER log_todos_changes
AFTER INSERT OR UPDATE OR DELETE ON todos
FOR EACH ROW
EXECUTE FUNCTION log_changes('name');

CREATE TRIGGER log_todos_description_changes
AFTER INSERT OR UPDATE OR DELETE ON todos
FOR EACH ROW
EXECUTE FUNCTION log_changes('description');

-- Create a function to log changes in the audit_log table
CREATE OR REPLACE FUNCTION log_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, column_name, new_value, operation, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, TG_ARGV[0], NEW[TG_ARGV[0]]::TEXT, TG_OP, NEW.changed_by);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD[TG_ARGV[0]] IS DISTINCT FROM NEW[TG_ARGV[0]] THEN
      INSERT INTO audit_log (table_name, record_id, column_name, old_value, new_value, operation, changed_by)
      VALUES (TG_TABLE_NAME, NEW.id, TG_ARGV[0], OLD[TG_ARGV[0]]::TEXT, NEW[TG_ARGV[0]]::TEXT, TG_OP, NEW.changed_by);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, record_id, column_name, old_value, operation, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, TG_ARGV[0], OLD[TG_ARGV[0]]::TEXT, TG_OP, OLD.changed_by);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
