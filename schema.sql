-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'budget_threshold' | 'monthly_summary' | 'split_settled' | 'member_joined'
  message TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for notifications
-- 1. Users can view their own notifications
CREATE POLICY "Users can view their own notifications" 
ON public.notifications
FOR SELECT 
USING (auth.uid() = user_id);

-- 2. Users can update their own notifications (e.g. mark as read)
CREATE POLICY "Users can update their own notifications" 
ON public.notifications
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create index for faster querying
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_workspace_id_idx ON public.notifications(workspace_id);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON public.notifications(user_id) WHERE read_at IS NULL;

-- Create recurring_expenses table
CREATE TABLE IF NOT EXISTS public.recurring_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  vendor VARCHAR(255) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'detected' NOT NULL, -- 'detected', 'confirmed', 'dismissed'
  next_expected_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

-- Create policies for recurring_expenses
-- 1. Users can view recurring expenses for workspaces they belong to
CREATE POLICY "Users can view recurring expenses in their workspaces"
ON public.recurring_expenses
FOR SELECT
USING (
  workspace_id IN (
    SELECT m.workspace_id FROM public.workspace_members m WHERE m.user_id = auth.uid()
  )
);

-- 2. Users can modify recurring expenses in their workspaces
CREATE POLICY "Users can modify recurring expenses in their workspaces"
ON public.recurring_expenses
FOR ALL
USING (
  workspace_id IN (
    SELECT m.workspace_id FROM public.workspace_members m WHERE m.user_id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS recurring_expenses_workspace_idx ON public.recurring_expenses(workspace_id);

-- Link receipt images to expenses
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT DEFAULT NULL;

-- Create activity_logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action VARCHAR(20) NOT NULL, -- 'create', 'update', 'delete'
  table_name VARCHAR(50) NOT NULL, -- 'expenses', 'budgets'
  record_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for activity_logs
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Select policy
CREATE POLICY "Users can view activity logs in their workspaces"
ON public.activity_logs
FOR SELECT
USING (
  workspace_id IN (
    SELECT m.workspace_id FROM public.workspace_members m WHERE m.user_id = auth.uid()
  )
);

-- Create trigger function for logging activities automatically
CREATE OR REPLACE FUNCTION public.log_activity_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_user_email VARCHAR;
  v_workspace_id UUID;
  v_message TEXT;
BEGIN
  -- Extract email from active Supabase session jwt
  BEGIN
    v_user_email := COALESCE(auth.jwt() ->> 'email', 'system');
  EXCEPTION WHEN OTHERS THEN
    v_user_email := 'system';
  END;

  v_user_email := split_part(v_user_email, '@', 1);

  IF (TG_TABLE_NAME = 'expenses') THEN
    IF (TG_OP = 'INSERT') THEN
      v_message := v_user_email || ' added expense "' || NEW.title || '" (Rs ' || to_char(NEW.amount, 'FM999,999,999') || ')';
      v_workspace_id := NEW.workspace_id;
      
      INSERT INTO public.activity_logs (workspace_id, user_id, action, table_name, record_id, message)
      VALUES (v_workspace_id, auth.uid(), 'create', 'expenses', NEW.id, v_message);
    ELSIF (TG_OP = 'UPDATE') THEN
      IF (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
        v_message := v_user_email || ' deleted expense "' || NEW.title || '"';
        v_workspace_id := NEW.workspace_id;
        
        INSERT INTO public.activity_logs (workspace_id, user_id, action, table_name, record_id, message)
        VALUES (v_workspace_id, auth.uid(), 'delete', 'expenses', NEW.id, v_message);
      ELSIF (OLD.title <> NEW.title OR OLD.amount <> NEW.amount) THEN
        v_message := v_user_email || ' updated expense "' || OLD.title || '"';
        IF (OLD.amount <> NEW.amount) THEN
          v_message := v_message || ' amount from Rs ' || to_char(OLD.amount, 'FM999,999,999') || ' to Rs ' || to_char(NEW.amount, 'FM999,999,999');
        END IF;
        v_workspace_id := NEW.workspace_id;

        INSERT INTO public.activity_logs (workspace_id, user_id, action, table_name, record_id, message)
        VALUES (v_workspace_id, auth.uid(), 'update', 'expenses', NEW.id, v_message);
      END IF;
    END IF;
  ELSIF (TG_TABLE_NAME = 'budgets') THEN
    IF (TG_OP = 'INSERT') THEN
      v_message := v_user_email || ' set budget to Rs ' || to_char(NEW.amount, 'FM999,999,999') || ' for ' || NEW.month;
      v_workspace_id := NEW.workspace_id;
      
      INSERT INTO public.activity_logs (workspace_id, user_id, action, table_name, record_id, message)
      VALUES (v_workspace_id, auth.uid(), 'create', 'budgets', NEW.id, v_message);
    ELSIF (TG_OP = 'UPDATE') THEN
      IF (OLD.amount <> NEW.amount) THEN
        v_message := v_user_email || ' updated budget for ' || NEW.month || ' from Rs ' || to_char(OLD.amount, 'FM999,999,999') || ' to Rs ' || to_char(NEW.amount, 'FM999,999,999');
        v_workspace_id := NEW.workspace_id;
        
        INSERT INTO public.activity_logs (workspace_id, user_id, action, table_name, record_id, message)
        VALUES (v_workspace_id, auth.uid(), 'update', 'budgets', NEW.id, v_message);
      END IF;
    ELSIF (TG_OP = 'DELETE') THEN
      v_message := v_user_email || ' deleted budget of Rs ' || to_char(OLD.amount, 'FM999,999,999') || ' for ' || OLD.month;
      v_workspace_id := OLD.workspace_id;
      
      INSERT INTO public.activity_logs (workspace_id, user_id, action, table_name, record_id, message)
      VALUES (v_workspace_id, auth.uid(), 'delete', 'budgets', OLD.id, v_message);
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create Triggers
DROP TRIGGER IF EXISTS trg_expenses_activity ON public.expenses;
CREATE TRIGGER trg_expenses_activity
AFTER INSERT OR UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.log_activity_trigger();

DROP TRIGGER IF EXISTS trg_budgets_activity ON public.budgets;
CREATE TRIGGER trg_budgets_activity
AFTER INSERT OR UPDATE OR DELETE ON public.budgets
FOR EACH ROW EXECUTE FUNCTION public.log_activity_trigger();

CREATE INDEX IF NOT EXISTS activity_logs_workspace_idx ON public.activity_logs(workspace_id);



