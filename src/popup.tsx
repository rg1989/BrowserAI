import React from "react";
import { PopupInterface } from "./components/PopupInterface";

// Plasmo popup component
const PopupComponent: React.FC = () => {
  const handleSettingsChange = (settings: any) => {
    console.log("Settings changed:", settings);
  };

  const handlePrivacySettingsClick = () => {
    if (chrome?.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  };

  return (
    <PopupInterface
      onSettingsChange={handleSettingsChange}
      onPrivacySettingsClick={handlePrivacySettingsClick}
    />
  );
};

export default PopupComponent;
