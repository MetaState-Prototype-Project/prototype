import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  gradient: string;
}

export default function StatsCard({ title, value, icon: Icon, gradient }: StatsCardProps) {
  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-6 soft-shadow hover-lift fade-in">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
        <div className={`w-12 h-12 ${gradient} rounded-2xl flex items-center justify-center`}>
          <Icon className="text-white" size={20} />
        </div>
      </div>
    </div>
  );
}
