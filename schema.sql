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


