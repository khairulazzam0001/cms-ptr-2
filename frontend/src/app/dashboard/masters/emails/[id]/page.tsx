'use client';
import { useParams } from 'next/navigation';
import EmailEditorForm from '@/components/emails/EmailEditorForm';

export default function EditEmailPage() {
  const { id } = useParams<{ id: string }>();
  return <EmailEditorForm emailId={id} />;
}
