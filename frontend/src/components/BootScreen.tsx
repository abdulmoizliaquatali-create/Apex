import { Icon } from './ui';

export default function BootScreen({ title, sub }: { title?: string; sub?: string }) {
  return (
    <div className="boot-screen">
      <div className="boot-logo">A</div>
      <div className="boot-brand">{title || 'Apex Gloves'}</div>
      <div className="boot-sub">{sub || 'Loading your trading & accounting suite'}</div>
      <div className="boot-progress">
        <div className="boot-progress-bar" />
      </div>
      <div className="boot-spinner">
        <Icon name="refresh" size={18} />
      </div>
    </div>
  );
}
