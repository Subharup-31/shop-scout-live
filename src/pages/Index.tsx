const Index = () => {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center space-y-6 max-w-2xl">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Your App is Running! 🎉
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 leading-relaxed">
            Great! The prototype is now visible. You can start building your amazing project.
          </p>
          <div className="mt-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
            <p className="text-gray-700 dark:text-gray-300">
              ✅ React app is working<br/>
              ✅ Tailwind CSS is loaded<br/>
              ✅ Dark mode support enabled<br/>
              ✅ Ready for development
            </p>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Index;
