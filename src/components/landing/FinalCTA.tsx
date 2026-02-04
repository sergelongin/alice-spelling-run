import { Link } from 'react-router-dom';

export function FinalCTA() {
  return (
    <section className="py-16 sm:py-20 bg-gradient-to-b from-green-600 to-green-700">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
          Ready to help your child become a confident speller?
        </h2>

        <Link
          to="/signup"
          className="inline-block px-10 py-4 bg-white text-green-700 text-lg font-semibold rounded-xl hover:bg-gray-50 transition-colors shadow-lg"
        >
          Create Free Account
        </Link>

        <p className="mt-4 text-green-100">
          100% Free &bull; No Credit Card Required
        </p>
      </div>
    </section>
  );
}
