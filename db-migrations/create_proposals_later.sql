
-- Create the function to handle briefing proposal decisions
CREATE OR REPLACE FUNCTION handle_proposal_decision(
  proposal_id INTEGER,
  decision TEXT,
  decision_notes TEXT
) RETURNS VOID AS $$
DECLARE
  briefing_type TEXT;
  new_prompt TEXT;
BEGIN
  UPDATE briefing_proposals
  SET decision = decision, decision_notes = decision_notes, decided_at = CURRENT_TIMESTAMP
  WHERE id = proposal_id;

  IF decision = 'accepted' THEN
    SELECT b.briefing_type, bp.proposal INTO briefing_type, new_prompt
    FROM briefing_proposals bp
    JOIN briefings b ON bp.briefing_id = b.id
    WHERE bp.id = proposal_id;

    INSERT INTO briefing_prompts (briefing_type, prompt, version)
    VALUES (briefing_type, new_prompt, (SELECT MAX(version) + 1 FROM briefing_prompts WHERE briefing_type = briefing_type));
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create the view to get the current briefing prompts
CREATE OR REPLACE VIEW current_briefing_prompts AS
SELECT DISTINCT ON (briefing_type) *
FROM briefing_prompts
ORDER BY briefing_type, version DESC;

-- Enable the pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the project briefing generation for each project
SELECT cron.schedule('project_briefing_' || id, '0 6 * * 1-5', $$
  INSERT INTO briefings (briefing_type, content, missive_conversation_id, project_id)
  VALUES ('project', generate_project_briefing($$ || id || $$), get_project_conversation_id($$ || id || $$), $$ || id || $$);
$$)
FROM projects;

  -- Retrieve the proposal text and the Missive conversation ID from the database
  SELECT bp.proposal, b.missive_conversation_id INTO proposal_text, missive_conversation_id
  FROM briefing_proposals bp
  JOIN briefings b ON bp.briefing_id = b.id
  WHERE bp.id = proposal_id;

  -- Send the proposal text as a post to the specified conversation in Missive
  PERFORM net.http_post(
    'https://api.missiveapp.com/v1/posts', -- Missive's "CREATE A POST" endpoint
    json_build_object(
      'conversation_id', missive_conversation_id,
      'content', 'New Briefing Proposal:\n' || proposal_text
    )::text, -- Ensure proper formatting as JSON text
    json_build_object(
      'Authorization', 'Bearer ' || current_setting('missive.api_key'), -- Use the stored Missive API key
      'Content-Type', 'application/json'
    )::text -- Ensure proper formatting as JSON text
  );
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to send a notification after inserting a new briefing proposal
CREATE TRIGGER send_proposal_notification_trigger
AFTER INSERT ON briefing_proposals
FOR EACH ROW
EXECUTE FUNCTION send_proposal_notification(NEW.id);