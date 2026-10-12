import { Icon } from './Icon';

export interface ConflictCardProps {
  text: string;
  title?: string;
}

export function ConflictCard({ text, title = 'Worth discussing' }: ConflictCardProps) {
  return (
    <section className="card card-conflict" aria-label={title}>
      <h3><Icon name="discuss" /> {title}</h3>
      <p>{text}</p>
    </section>
  );
}
