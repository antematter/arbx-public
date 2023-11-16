export interface ArbxButtonProps {
  text: string;
  textColor?: 'red' | 'green' | 'blue';
  onClick: () => void;
  focused: boolean;
}
