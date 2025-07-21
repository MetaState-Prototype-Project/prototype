import { BarChart3 } from "lucide-react";

interface ResultsChartProps {
  results: {
    poll: any;
    results: Array<{
      id: number;
      text: string;
      votes: number;
      voters: Array<{
        userId: string;
        timestamp: string;
      }>;
    }>;
    totalVotes: number;
  };
}

export default function ResultsChart({ results }: ResultsChartProps) {
  return (
    <div className="card p-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        <BarChart3 className="inline w-5 h-5 mr-2" />
        Vote Distribution
      </h3>
      
      <div className="space-y-4">
        {results.results.map((option) => {
          const percentage = results.totalVotes > 0 ? (option.votes / results.totalVotes * 100) : 0;
          return (
            <div key={option.id} className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">{option.text}</span>
                <span className="text-sm text-gray-600">
                  {option.votes} votes ({percentage.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-(--crimson) h-3 rounded-full transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
