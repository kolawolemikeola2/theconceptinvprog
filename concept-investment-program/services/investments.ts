import { supabase } from '../lib/supabase';

export type PaymentAccount = {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  currency: 'USD';
  payment_instructions: string;
  is_active: boolean;
};

export async function getActivePaymentAccount(): Promise<PaymentAccount | null> {
  const { data, error } = await supabase
    .from('payment_accounts')
    .select('id,bank_name,account_name,account_number,currency,payment_instructions,is_active')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as PaymentAccount | null;
}

export async function submitInvestmentApplication(input: {
  amount: number;
  receiptUri: string;
  receiptMimeType?: string | null;
  transactionReference?: string;
}) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('Please sign in again before submitting an investment application.');
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('Enter a valid investment amount.');

  const mimeType = input.receiptMimeType || 'image/jpeg';
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const objectPath = `${authData.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const fileResponse = await fetch(input.receiptUri);
  if (!fileResponse.ok) throw new Error('Could not read the selected receipt image. Please select it again.');
  const bytes = await fileResponse.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from('payment-receipts')
    .upload(objectPath, bytes, { contentType: mimeType, upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('investment_applications')
    .insert({
      user_id: authData.user.id,
      amount: Number(input.amount.toFixed(2)),
      currency: 'USD',
      duration_months: 24,
      monthly_roi_rate: 0.025,
      transaction_reference: input.transactionReference?.trim() || null,
      receipt_path: objectPath,
      status: 'pending_review',
    })
    .select('id,status,amount,currency,duration_months,monthly_roi_rate,submitted_at')
    .single();

  if (error) {
    // Avoid leaving an orphaned receipt if the database insert fails.
    await supabase.storage.from('payment-receipts').remove([objectPath]);
    throw error;
  }
  return data;
}

export async function getMyApplications() {
  const { data, error } = await supabase.from('investment_applications')
    .select('id,amount,currency,duration_months,monthly_roi_rate,status,transaction_reference,receipt_path,admin_notes,submitted_at,reviewed_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getMyInvestments() {
  const { data, error } = await supabase.from('investments')
    .select('id,application_id,principal,currency,duration_months,monthly_roi_rate,start_date,maturity_date,status,created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getMyRoiPayments() {
  const { data, error } = await supabase.from('roi_payments')
    .select('id,investment_id,period_month,due_date,amount,currency,status,paid_at,payout_reference,reinvested_at,payout_notes')
    .order('due_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getPendingApplicationsForAdmin() {
  const { data, error } = await supabase.from('investment_applications')
    .select('id,user_id,amount,currency,duration_months,monthly_roi_rate,transaction_reference,receipt_path,submitted_at,status')
    .eq('status', 'pending_review')
    .order('submitted_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function reviewApplication(applicationId: string, decision: 'approved' | 'rejected', notes?: string) {
  const { data, error } = await supabase.rpc('review_investment_application', {
    p_application_id: applicationId,
    p_decision: decision,
    p_admin_notes: notes?.trim() || null,
  });
  if (error) throw error;
  return data;
}

export async function createReceiptSignedUrl(path: string) {
  const { data, error } = await supabase.storage.from('payment-receipts').createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}
