import { Box, Flex, Spinner, useColorModeValue } from "@chakra-ui/react";
import { Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { authRoutes } from "routes";

// Pages shown before logging in
export default function Auth() {
  const authBg = useColorModeValue("white", "navy.900");
  return (
    <Box bg={authBg} minH="100vh">
      <Suspense fallback={<Flex justify="center" align="center" h="100vh"><Spinner /></Flex>}>
        <Routes>
          {authRoutes.map((route) => <Route key={route.path} path={route.path} element={<route.component />} />)}
          <Route path="*" element={<Navigate to="/auth/sign-in" replace />} />
        </Routes>
      </Suspense>
    </Box>
  );
}
