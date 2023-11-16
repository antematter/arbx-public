import React from 'react';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

import { ArbxGraphProps } from './ArbxGraph.type';

import { FC } from 'react';

const ArbsGraph: FC<ArbxGraphProps> = ({ data }) => {
  return (
    <div className="w-full h-full bg-black">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart width={400} height={400} data={data} margin={{ right: 40, top: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} horizontal={false} />
          <XAxis dataKey="index" tick={false} />
          <YAxis />
          <Tooltip />
          <Legend formatter={(value) => <span className="text-[#00FF00]">{value}</span>} />
          <Line
            type="monotone"
            dataKey="profit"
            stroke="#00FF00"
            strokeWidth={2}
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ArbsGraph;
//<Frame w={829} h={335} bg="black">
