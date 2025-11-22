import { GetServerSideProps } from 'next';

export default function HealthCheck() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Health Check</h1>
      <p>Frontend is running!</p>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {},
  };
};
