import { Badge } from "@/components/ui/badge";

interface PlatformBadgeProps {
  platform: string;
  className?: string;
}

export function PlatformBadge({ platform, className = "" }: PlatformBadgeProps) {
  const getPlatformConfig = (platform: string) => {
    switch (platform) {
      case 'instagram':
      case 'facebook':
        return {
          name: 'Pictique',
          className: 'bg-linear-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600'
        };
      case 'twitter':
      case 'discord':
        return {
          name: 'Blabsy',
          className: 'bg-blue-500 text-white hover:bg-blue-600'
        };
      default:
        return {
          name: 'Unknown',
          className: 'bg-gray-500 text-white hover:bg-gray-600'
        };
    }
  };

  const config = getPlatformConfig(platform);

  return (
    <Badge className={`${config.className} font-medium border-0 ${className}`}>
      {config.name}
    </Badge>
  );
}