import React, { useState } from 'react';
import { StarIcon } from '../../lib/icons';

interface StarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  className?: string;
}

export const StarRating = ({ rating, onRatingChange, className }: StarRatingProps) => {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onRatingChange && onRatingChange(star)}
          onMouseEnter={() => onRatingChange && setHoverRating(star)}
          onMouseLeave={() => onRatingChange && setHoverRating(0)}
          className={`transition-colors ${onRatingChange ? 'cursor-pointer' : ''}`}
          disabled={!onRatingChange}
        >
          <StarIcon
            className={`h-5 w-5 ${
              (hoverRating || rating) >= star ? 'text-yellow-400' : 'text-gray-600'
            }`}
            filled={(hoverRating || rating) >= star}
          />
        </button>
      ))}
    </div>
  );
};
