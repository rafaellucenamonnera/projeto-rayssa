
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY[
 'card_responsible_assigned','task_assigned','task_updated','task_deadline_48h','task_deadline_24h',
 'comment_mention','lead_auto_lost','commercial_proposal_opened','commercial_proposal_accepted',
 'cross_card_created','cross_card_updated','cross_stage_changed','cross_task_created','cross_task_updated',
 'cross_task_completed','cross_task_deleted','cross_attachment_added','cross_attachment_removed',
 'cross_block_created','cross_block_resolved','cross_note_updated','cross_triagem_divergencia'
]));
