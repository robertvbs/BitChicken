import { Injectable } from '@angular/core';

const JWT_STORAGE_KEY = 'bc.pinataJwt';
const PINATA_UPLOAD_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

@Injectable({ providedIn: 'root' })
export class PinataUploadService {
  setJwt(jwt: string): void {
    localStorage.setItem(JWT_STORAGE_KEY, jwt);
  }

  getJwt(): string {
    return localStorage.getItem(JWT_STORAGE_KEY) ?? '';
  }

  async uploadImage(file: File): Promise<string> {
    const jwt = this.getJwt();
    if (!jwt) {
      throw new Error('Pinata JWT not configured. Set it in the admin panel.');
    }
    const form = new FormData();
    form.append('file', file);
    const response = await fetch(PINATA_UPLOAD_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: form,
    });
    if (!response.ok) {
      throw new Error(`Pinata upload failed: ${response.status} ${response.statusText}`);
    }
    const data = (await response.json()) as { IpfsHash: string };
    return data.IpfsHash;
  }
}
